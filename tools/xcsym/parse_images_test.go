package main

import "testing"

const ipsV1Fixture = `{
  "bug_type": "309",
  "usedImages": [
    {"uuid": "aabbccdd-eeff-0011-2233-445566778899", "name": "MyApp", "path": "/path/MyApp", "arch": "arm64", "base": 4295049216, "size": 45056},
    {"uuid": "", "name": "???", "path": "", "arch": "arm64"},
    {"uuid": "11223344-5566-7788-99AA-BBCCDDEEFF00", "name": "UIKit", "arch": "arm64e"}
  ]
}`

func TestParseUsedImages_IPSv1(t *testing.T) {
	imgs, err := ParseUsedImages([]byte(ipsV1Fixture), FormatIPSv1)
	if err != nil {
		t.Fatalf("ParseUsedImages: %v", err)
	}
	if len(imgs) != 2 {
		t.Fatalf("got %d images, want 2 (empty-UUID entry should be dropped)", len(imgs))
	}
	if imgs[0].UUID != "AABBCCDD-EEFF-0011-2233-445566778899" {
		t.Errorf("UUID[0] = %q, want uppercase dashed form", imgs[0].UUID)
	}
	if imgs[0].Name != "MyApp" || imgs[0].Arch != "arm64" {
		t.Errorf("img[0] = %+v", imgs[0])
	}
}

func TestParseUsedImages_IPSv2(t *testing.T) {
	header := `{"app_name":"MyApp","timestamp":"2026-04-19"}`
	payload := ipsV1Fixture
	doc := header + "\n" + payload
	imgs, err := ParseUsedImages([]byte(doc), FormatIPSv2)
	if err != nil {
		t.Fatalf("ParseUsedImages: %v", err)
	}
	if len(imgs) != 2 {
		t.Errorf("got %d images, want 2", len(imgs))
	}
}

func TestParseUsedImages_MetricKitNotSupported(t *testing.T) {
	_, err := ParseUsedImages([]byte(`{}`), FormatMetricKit)
	if err == nil {
		t.Error("expected MetricKit format to be rejected (Phase 5)")
	}
}

func TestParseUsedImages_UnknownFormat(t *testing.T) {
	_, err := ParseUsedImages([]byte(`{}`), FormatUnknown)
	if err == nil {
		t.Error("expected unknown format to be rejected")
	}
}
