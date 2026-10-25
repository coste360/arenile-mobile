// Pinned URLSessions (one per paired host and port, rebuilt when the
// fingerprint changes) and the running tasks, so that JavaScript can cancel them.
import ExpoModulesCore
import Foundation

struct PinnedRequest: Record {
  @Field var url: String = ""
  @Field var method: String = "GET"
  @Field var headers: [String: String] = [:]
  @Field var body: String? = nil
  @Field var fingerprint: String = ""
  @Field var timeoutMs: Double = 60_000
}

enum PinnedErrorCode {
  static let certificateMismatch = "ERR_PINNED_CERTIFICATE_MISMATCH"
  static let invalidRequest = "ERR_PINNED_INVALID_REQUEST"
  static let cancelled = "ERR_PINNED_CANCELLED"
  static let network = "ERR_PINNED_NETWORK"
}

final class PinnedSessionRegistry {
  private struct Entry {
    let session: URLSession
    let delegate: PinnedSessionDelegate
  }

  private let lock = NSLock()
  private var sessions: [String: Entry] = [:]
  private var tasks: [String: URLSessionTask] = [:]
  private var cancelled = Set<String>()

  func perform(id: String, request: PinnedRequest, promise: Promise) {
    guard
      let expected = PinnedFingerprint.parse(request.fingerprint),
      let url = URL(string: request.url),
      url.scheme?.lowercased() == "https",
      let host = url.host,
      !host.isEmpty
    else {
      promise.reject(PinnedErrorCode.invalidRequest, "invalid pinned request")
      return
    }
    let port = url.port ?? 443
    let entry = session(host: host, port: port, expected: expected)

    var urlRequest = URLRequest(
      url: url,
      cachePolicy: .reloadIgnoringLocalCacheData,
      timeoutInterval: max(1, request.timeoutMs / 1000)
    )
    urlRequest.httpMethod = request.method
    urlRequest.httpShouldHandleCookies = false
    for (name, value) in request.headers {
      urlRequest.setValue(value, forHTTPHeaderField: name)
    }
    if let body = request.body {
      urlRequest.httpBody = Data(body.utf8)
    }

    var taskIdentifier = -1
    let task = entry.session.dataTask(with: urlRequest) { [weak self] data, response, error in
      let wasCancelled = self?.finish(id: id) ?? false
      if let error {
        if entry.delegate.takeRejection(of: taskIdentifier) {
          promise.reject(PinnedErrorCode.certificateMismatch, "certificate fingerprint mismatch")
        } else if wasCancelled {
          promise.reject(PinnedErrorCode.cancelled, "request cancelled")
        } else {
          promise.reject(PinnedErrorCode.network, "network error (\((error as NSError).code))")
        }
        return
      }
      guard let http = response as? HTTPURLResponse else {
        promise.reject(PinnedErrorCode.network, "not an HTTP response")
        return
      }
      var headers: [String: String] = [:]
      for (key, value) in http.allHeaderFields {
        if let name = key as? String {
          headers[name.lowercased()] = "\(value)"
        }
      }
      promise.resolve([
        "status": http.statusCode,
        "statusText": "",
        "headers": headers,
        "body": String(decoding: data ?? Data(), as: UTF8.self),
        "url": http.url?.absoluteString ?? request.url,
      ] as [String: Any])
    }
    taskIdentifier = task.taskIdentifier
    lock.lock()
    tasks[id] = task
    lock.unlock()
    task.resume()
  }

  func cancel(id: String) {
    lock.lock()
    let task = tasks[id]
    if task != nil {
      cancelled.insert(id)
    }
    lock.unlock()
    task?.cancel()
  }

  func invalidateAll() {
    lock.lock()
    let all = sessions.values
    sessions.removeAll()
    lock.unlock()
    all.forEach { $0.session.invalidateAndCancel() }
  }

  /// Removes a finished task; returns true when JavaScript had cancelled it.
  private func finish(id: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    tasks.removeValue(forKey: id)
    return cancelled.remove(id) != nil
  }

  private func session(host: String, port: Int, expected: Data) -> Entry {
    let key = "\(host.lowercased()):\(port)"
    lock.lock()
    defer { lock.unlock() }
    if let existing = sessions[key], existing.delegate.expected == expected {
      return existing
    }
    // A new fingerprint for the same server (pairing again after a renewal):
    // drop the old session and its connections.
    sessions[key]?.session.invalidateAndCancel()

    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil
    configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil
    configuration.urlCache = nil
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.tlsMinimumSupportedProtocolVersion = .TLSv12
    let delegate = PinnedSessionDelegate(host: host, port: port, expected: expected)
    let entry = Entry(
      session: URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil),
      delegate: delegate
    )
    sessions[key] = entry
    return entry
  }
}
