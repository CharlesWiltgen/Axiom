BINARY := xcprof
OUTDIR := ../../.claude-plugin/plugins/axiom/bin
BIN := $(OUTDIR)/$(BINARY)

.PHONY: all build install test fuzz clean

all: build

build:
	GOARCH=amd64 GOOS=darwin go build -o $(BINARY)-amd64 .
	GOARCH=arm64 GOOS=darwin go build -o $(BINARY)-arm64 .
	lipo -create -output $(BINARY) $(BINARY)-amd64 $(BINARY)-arm64
	@file $(BINARY)

install: build
	install -m 755 $(BINARY) $(BIN)
	@echo "Installed to $(BIN)"
	@file $(BIN)

test:
	go test -v ./...

fuzz:
	go test -fuzz=FuzzParseCPUProfile -fuzztime=60s

clean:
	rm -f $(BINARY) $(BINARY)-amd64 $(BINARY)-arm64
