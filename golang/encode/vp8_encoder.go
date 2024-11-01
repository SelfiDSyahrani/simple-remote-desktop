package encode

/*
#cgo LDFLAGS: -lvpx
#include "vp8encoder.c"
*/
import "C"
import (
	"fmt"
	"image"
	"unsafe"
)

// EncodeToVP8 encodes an RGBA image to VP8 format.
func EncodeToVP8(img *image.RGBA) ([]byte, error) {
	width := C.int(img.Rect.Dx())
	height := C.int(img.Rect.Dy())

	// Convert Go image.RGBA to a C pointer
	rgba := (*C.uint8_t)(unsafe.Pointer(&img.Pix[0]))

	// Call the C function to encode the RGBA image to VP8
	encodedData := C.encode_rgba_to_vp8(rgba, width, height)
	if encodedData == nil {
		return nil, fmt.Errorf("VP8 encoding failed")
	}
	defer C.free_encoded_data(encodedData)

	// Convert the encoded data to a Go byte slice
	output := C.GoBytes(unsafe.Pointer(encodedData.data), C.int(encodedData.length))
	return output, nil
}
