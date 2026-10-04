BINARY := axbuild
OUTDIR := ../../.claude-plugin/plugins/axiom/bin

.PHONY: build install test clean

build:
	mkdir -p .build
	node ../../scripts/swift-tool.ts snapshot axbuild > .build/build-inputs.json
	xcrun swift build -c release --triple arm64-apple-macosx14.0 --scratch-path .build/arm64
	xcrun swift build -c release --triple x86_64-apple-macosx14.0 --scratch-path .build/x86_64
	lipo -create "$$(xcrun swift build -c release --triple arm64-apple-macosx14.0 --scratch-path .build/arm64 --show-bin-path)/$(BINARY)" "$$(xcrun swift build -c release --triple x86_64-apple-macosx14.0 --scratch-path .build/x86_64 --show-bin-path)/$(BINARY)" -output $(BINARY)
	lipo $(BINARY) -verify_arch arm64
	lipo $(BINARY) -verify_arch x86_64
	strip -S $(BINARY)
	file $(BINARY)

install: build
	install -m 755 $(BINARY) $(OUTDIR)/$(BINARY)
	node ../../scripts/swift-tool.ts record .build/build-inputs.json axbuild

test:
	xcrun swift test
	AXIOM_AXBUILD="$$(xcrun swift build --show-bin-path)/$(BINARY)" node --test axbuild.test.ts

clean:
	rm -rf .build
	rm -f $(BINARY)
