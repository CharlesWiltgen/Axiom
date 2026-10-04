import Testing

@Test func testFailureST() {
  let actual = 3
  #expect(actual == 4, "ST_MARKER")
}
@Test func testPassST() { #expect(true) }
@Test func knownIssueST() { withKnownIssue("KNOWN_MARKER") { #expect(1 == 2) } }
