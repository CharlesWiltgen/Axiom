import Foundation
import Testing

@Test(.enabled(if: ProcessInfo.processInfo.environment["AXBUILD_STRESS"] == "YES"))
func stress() {
  for value in 0..<250 {
    #expect(value == -1, "STRESS_MARKER")
  }
}
