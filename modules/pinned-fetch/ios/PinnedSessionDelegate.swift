// URLSession delegate of the pinned transport (ADR 0006): answers the server
// trust challenge with `.useCredential` only for the paired host and port and
// only when the SHA-256 of the leaf certificate equals the pinned fingerprint;
// anything else is cancelled. System trust evaluation is replaced ONLY for
// sessions built by PinnedSessionRegistry, never for the rest of the app.
import Foundation
import Security

final class PinnedSessionDelegate: NSObject, URLSessionTaskDelegate {
  let host: String
  let port: Int
  let expected: Data

  private let lock = NSLock()
  private var rejectedTasks = Set<Int>()

  init(host: String, port: Int, expected: Data) {
    self.host = host
    self.port = port
    self.expected = expected
  }

  /// True (once) when the task failed because the certificate did not match.
  func takeRejection(of taskIdentifier: Int) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return rejectedTasks.remove(taskIdentifier) != nil
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    let space = challenge.protectionSpace
    guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust else {
      // No client certificates or HTTP authentication on this transport (no credential storage).
      completionHandler(.performDefaultHandling, nil)
      return
    }
    guard
      space.host.caseInsensitiveCompare(host) == .orderedSame,
      space.port == port,
      let trust = space.serverTrust,
      let leaf = PinnedFingerprint.leafCertificate(of: trust),
      PinnedFingerprint.matches(certificate: leaf, expected: expected)
    else {
      lock.lock()
      rejectedTasks.insert(task.taskIdentifier)
      lock.unlock()
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }

  /// Redirects are never followed: the 3xx answer goes back to JavaScript as is.
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }
}
