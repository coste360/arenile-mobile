// Expo module "PinnedFetch" (ADR 0006): the JavaScript contract is in
// modules/pinned-fetch/src/PinnedFetch.types.ts.
import ExpoModulesCore

public final class PinnedFetchModule: Module {
  private let registry = PinnedSessionRegistry()

  public func definition() -> ModuleDefinition {
    let registry = self.registry

    Name("PinnedFetch")

    AsyncFunction("fetch") { (id: String, request: PinnedRequest, promise: Promise) in
      registry.perform(id: id, request: request, promise: promise)
    }

    AsyncFunction("cancel") { (id: String) in
      registry.cancel(id: id)
    }

    OnDestroy {
      registry.invalidateAll()
    }
  }
}
