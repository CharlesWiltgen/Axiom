public func gamma(_ x: Int) -> Int { x }
#if AXBUILD_FAULTS
  public func delta() -> Int { gamma("ERR_THREE") }
#endif
