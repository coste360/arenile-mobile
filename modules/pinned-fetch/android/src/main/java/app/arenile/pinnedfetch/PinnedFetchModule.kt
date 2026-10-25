package app.arenile.pinnedfetch

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Expo module "PinnedFetch" (ADR 0006); JavaScript contract in modules/pinned-fetch/src/PinnedFetch.types.ts. */
class PinnedFetchModule : Module() {
  private val clients = PinnedClients()

  override fun definition() = ModuleDefinition {
    Name("PinnedFetch")

    AsyncFunction("fetch") { id: String, request: PinnedRequest, promise: Promise ->
      clients.perform(id, request, promise)
    }

    AsyncFunction("cancel") { id: String ->
      clients.cancel(id)
    }

    OnDestroy {
      clients.shutdown()
    }
  }
}
