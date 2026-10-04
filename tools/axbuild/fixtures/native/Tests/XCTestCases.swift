import XCTest

final class NativeTests: XCTestCase {
  func testFailure() { XCTAssertEqual(3, 4, "XC_MARKER") }
  func testPass() { XCTAssertTrue(true) }
}
