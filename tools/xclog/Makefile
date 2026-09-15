BINARY := xclog
OUTDIR := ../../.claude-plugin/plugins/axiom/bin
BIN := $(OUTDIR)/$(BINARY)

.PHONY: all build install test clean

all: build

# -trimpath keeps the maintainer's source layout out of the shipped binary's
# debug info and build-info records. The other three tools carry it; xclog had
# no Makefile at all, so its binary was hand-built and shipped with the absolute
# path embedded (Axiom-1z8m).
build:
	GOARCH=amd64 GOOS=darwin go build -trimpath -ldflags "-s -w" -o $(BINARY)-amd64 .
	GOARCH=arm64 GOOS=darwin go build -trimpath -ldflags "-s -w" -o $(BINARY)-arm64 .
	lipo -create -output $(BINARY) $(BINARY)-amd64 $(BINARY)-arm64
	@file $(BINARY)

install: build
	install -m 755 $(BINARY) $(BIN)
	@echo "Installed to $(BIN)"
	@file $(BIN)

test:
	go test -v ./...

clean:
	rm -f $(BINARY) $(BINARY)-amd64 $(BINARY)-arm64
