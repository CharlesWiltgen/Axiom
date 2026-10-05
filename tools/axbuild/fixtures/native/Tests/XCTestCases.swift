import XCTest

final class NativeTests: XCTestCase {
  func testFailure() { XCTAssertEqual(3, 4, "XC_MARKER") }
  func testPass() { XCTAssertTrue(true) }
}

#if AXBUILD_TEST_FAULTS
let axbuildTestCompileFault: Int = "AXBUILD_TEST_COMPILE_FAULT"
#endif
