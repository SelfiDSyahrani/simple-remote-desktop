// vp8encoder.c
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <vpx/vpx_encoder.h>
#include <vpx/vp8cx.h>

typedef struct {
    uint8_t *data;
    size_t length;
} VP8EncodedData;

static VP8EncodedData* encode_rgba_to_vp8(uint8_t* rgba, int width, int height) {
    vpx_codec_ctx_t codec;
    vpx_codec_enc_cfg_t cfg;
    vpx_image_t img;
    VP8EncodedData* encoded_data = malloc(sizeof(VP8EncodedData));

    if (vpx_codec_enc_config_default(vpx_codec_vp8_cx(), &cfg, 0)) {
        return NULL;
    }

    cfg.g_w = width;
    cfg.g_h = height;
    cfg.rc_target_bitrate = 1000;  // Target bitrate in kbps

    if (vpx_codec_enc_init(&codec, vpx_codec_vp8_cx(), &cfg, 0)) {
        return NULL;
    }

    vpx_img_alloc(&img, VPX_IMG_FMT_I420, width, height, 1);

    // Convert RGBA to I420 format
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            uint8_t r = rgba[(y * width + x) * 4];
            uint8_t g = rgba[(y * width + x) * 4 + 1];
            uint8_t b = rgba[(y * width + x) * 4 + 2];

            img.planes[VPX_PLANE_Y][y * img.stride[VPX_PLANE_Y] + x] = (0.299 * r + 0.587 * g + 0.114 * b);
            if (x % 2 == 0 && y % 2 == 0) {
                img.planes[VPX_PLANE_U][(y / 2) * img.stride[VPX_PLANE_U] + (x / 2)] = (-0.169 * r - 0.331 * g + 0.5 * b) + 128;
                img.planes[VPX_PLANE_V][(y / 2) * img.stride[VPX_PLANE_V] + (x / 2)] = (0.5 * r - 0.419 * g - 0.081 * b) + 128;
            }
        }
    }

    if (vpx_codec_encode(&codec, &img, 0, 1, 0, VPX_DL_REALTIME)) {
        return NULL;
    }

    const vpx_codec_cx_pkt_t *pkt;
    vpx_codec_iter_t iter = NULL;
    while ((pkt = vpx_codec_get_cx_data(&codec, &iter))) {
        if (pkt->kind == VPX_CODEC_CX_FRAME_PKT) {
            encoded_data->length = pkt->data.frame.sz;
            encoded_data->data = malloc(encoded_data->length);
            memcpy(encoded_data->data, pkt->data.frame.buf, encoded_data->length);
            break;
        }
    }

    vpx_img_free(&img);
    vpx_codec_destroy(&codec);
    return encoded_data;
}

static void free_encoded_data(VP8EncodedData* encoded_data) {
    free(encoded_data->data);
    free(encoded_data);
}
