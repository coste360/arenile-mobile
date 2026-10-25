package app.arenile.pinnedfetch

import expo.modules.kotlin.Promise
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import okhttp3.Call
import okhttp3.Callback
import okhttp3.ConnectionSpec
import okhttp3.CookieJar
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

class PinnedRequest : Record {
  @Field var url: String = ""
  @Field var method: String = "GET"
  @Field var headers: Map<String, String> = emptyMap()
  @Field var body: String? = null
  @Field var fingerprint: String = ""
  @Field var timeoutMs: Double = 60_000.0
}

internal object PinnedErrorCode {
  const val CERTIFICATE_MISMATCH = "ERR_PINNED_CERTIFICATE_MISMATCH"
  const val INVALID_REQUEST = "ERR_PINNED_INVALID_REQUEST"
  const val CANCELLED = "ERR_PINNED_CANCELLED"
  const val NETWORK = "ERR_PINNED_NETWORK"
}

/**
 * Dedicated OkHttpClients of the pinned transport (one per paired host and
 * port, rebuilt when the fingerprint changes) and the running calls, so that
 * JavaScript can cancel them.
 */
internal class PinnedClients {
  private class Entry(val fingerprint: ByteArray, val client: OkHttpClient)

  private val clients = ConcurrentHashMap<String, Entry>()
  private val calls = ConcurrentHashMap<String, Call>()

  fun perform(id: String, request: PinnedRequest, promise: Promise) {
    val expected = PinnedFingerprint.parse(request.fingerprint)
    val url = request.url.toHttpUrlOrNull()
    if (expected == null || url == null || !url.isHttps) {
      promise.reject(PinnedErrorCode.INVALID_REQUEST, "invalid pinned request", null)
      return
    }
    val okRequest = try {
      buildRequest(request)
    } catch (e: IllegalArgumentException) {
      promise.reject(PinnedErrorCode.INVALID_REQUEST, "invalid pinned request", null)
      return
    }
    val client = clientFor(url.host, url.port, expected)
      .newBuilder()
      .callTimeout(request.timeoutMs.toLong().coerceAtLeast(1_000L), TimeUnit.MILLISECONDS)
      .build()

    val call = client.newCall(okRequest)
    calls[id] = call
    call.enqueue(object : Callback {
      override fun onFailure(call: Call, e: IOException) {
        calls.remove(id)
        when {
          e.hasCause<FingerprintMismatchException>() ->
            promise.reject(PinnedErrorCode.CERTIFICATE_MISMATCH, "certificate fingerprint mismatch", null)
          call.isCanceled() -> promise.reject(PinnedErrorCode.CANCELLED, "request cancelled", null)
          else -> promise.reject(PinnedErrorCode.NETWORK, "network error (${e.javaClass.simpleName})", null)
        }
      }

      override fun onResponse(call: Call, response: Response) {
        calls.remove(id)
        try {
          response.use { promise.resolve(toResult(it)) }
        } catch (e: IOException) {
          promise.reject(PinnedErrorCode.NETWORK, "network error (${e.javaClass.simpleName})", null)
        }
      }
    })
  }

  fun cancel(id: String) {
    calls[id]?.cancel()
  }

  fun shutdown() {
    calls.values.forEach { it.cancel() }
    calls.clear()
    clients.values.forEach { it.client.connectionPool.evictAll() }
    clients.clear()
  }

  private fun buildRequest(request: PinnedRequest): Request {
    val method = request.method.uppercase()
    val contentType = request.headers.entries
      .firstOrNull { it.key.equals("content-type", ignoreCase = true) }
      ?.value
      ?.toMediaTypeOrNull()
    val body: RequestBody? = when {
      request.body != null -> request.body!!.toByteArray(Charsets.UTF_8).toRequestBody(contentType)
      method in METHODS_WITH_BODY -> ByteArray(0).toRequestBody(null)
      else -> null
    }
    val builder = Request.Builder().url(request.url).method(method, body)
    request.headers.forEach { (name, value) -> builder.header(name, value) }
    return builder.build()
  }

  private fun toResult(response: Response): Map<String, Any?> {
    val headers = mutableMapOf<String, String>()
    for (name in response.headers.names()) {
      headers[name.lowercase()] = response.headers.values(name).joinToString(", ")
    }
    return mapOf(
      "status" to response.code,
      "statusText" to response.message,
      "headers" to headers,
      // The API answers JSON: decoded as UTF-8 unless the charset says otherwise.
      "body" to (response.body?.string() ?: ""),
      "url" to response.request.url.toString(),
    )
  }

  private fun clientFor(host: String, port: Int, expected: ByteArray): OkHttpClient {
    val key = "${host.lowercase()}:$port"
    synchronized(clients) {
      clients[key]?.let { if (it.fingerprint.contentEquals(expected)) return it.client }
      // A new fingerprint for the same server (pairing again after a renewal):
      // drop the old client and its connections.
      clients.remove(key)?.client?.connectionPool?.evictAll()
      val client = buildClient(host, expected)
      clients[key] = Entry(expected.copyOf(), client)
      return client
    }
  }

  private fun buildClient(host: String, expected: ByteArray): OkHttpClient {
    val trustManager = PinnedTrustManager(expected)
    val sslContext = SSLContext.getInstance("TLS").apply {
      init(null, arrayOf<TrustManager>(trustManager), null)
    }
    return OkHttpClient.Builder()
      .sslSocketFactory(sslContext.socketFactory, trustManager)
      // The pinned certificate is the identity; the hostname check only keeps
      // this client on the paired host.
      .hostnameVerifier { hostname, _ -> hostname.equals(host, ignoreCase = true) }
      .connectionSpecs(listOf(ConnectionSpec.MODERN_TLS))
      .followRedirects(false)
      .followSslRedirects(false)
      .cookieJar(CookieJar.NO_COOKIES)
      .cache(null)
      .build()
  }

  private companion object {
    val METHODS_WITH_BODY = setOf("POST", "PUT", "PATCH")
  }
}

private inline fun <reified T : Throwable> Throwable.hasCause(): Boolean {
  var current: Throwable? = this
  while (current != null) {
    if (current is T) return true
    current = current.cause.takeIf { it !== current }
  }
  return false
}
