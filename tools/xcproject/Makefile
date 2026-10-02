BINARY := xcproject
OUTDIR := ../../.claude-plugin/plugins/axiom/bin

.PHONY: build install test clean

build:
	xcrun swift build -c release --triple arm64-apple-macosx14.0 --scratch-path .build/arm64
	xcrun swift build -c release --triple x86_64-apple-macosx14.0 --scratch-path .build/x86_64
	lipo -create "$$(xcrun swift build -c release --triple arm64-apple-macosx14.0 --scratch-path .build/arm64 --show-bin-path)/$(BINARY)" "$$(xcrun swift build -c release --triple x86_64-apple-macosx14.0 --scratch-path .build/x86_64 --show-bin-path)/$(BINARY)" -output $(BINARY)
	strip -S $(BINARY)
	file $(BINARY)

install: build
	install -m 755 $(BINARY) $(OUTDIR)/$(BINARY)
	mkdir -p $(OUTDIR)/../licenses
	install -m 644 THIRD_PARTY_LICENSE.txt $(OUTDIR)/../licenses/xcproject.txt

test:
	xcrun swift build
	AXIOM_XCPROJECT="$$(xcrun swift build --show-bin-path)/$(BINARY)" node --test xcproject.test.ts

clean:
	rm -rf .build
	rm -f $(BINARY)
