# Local Expo module of the Arenile staff app (ADR 0006), autolinked from modules/.
Pod::Spec.new do |s|
  s.name           = 'PinnedFetch'
  s.version        = '1.0.0'
  s.summary        = 'HTTPS transport pinned to the SHA-256 of the desktop LAN certificate'
  s.description    = 'Accepts the Arenile desktop LAN server only when the leaf certificate matches the fingerprint saved at pairing.'
  s.author         = 'Coste360 SRL'
  s.homepage       = 'https://arenile.app'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.exclude_files = "Tests/**/*"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
