---
name: square-image
description: Center-crop a photo to a square and resize to exact dimensions without stretching. Use for square avatars/thumbnails, 256x256 images, or resizing the newest photo; accepts JPEG, PNG, HEIC, WebP, AVIF, TIFF, and other supported still images.
argument-hint: "[image path] [size, default 256]"
---

# Square image

1. Use the supplied image path; for "most recent," inspect recent user images (especially `~/Downloads`) and choose the newest by modification time across common photo extensions, not just JPG. Do not select repository assets by default.
2. Inspect the input with `sips -g format -g pixelWidth -g pixelHeight "$source"`. The square crop side is the smaller dimension. Default output dimensions to 256x256 unless specified. Preserve the original and write `<stem>-<size>x<size>.<extension>` alongside it.
3. Use native `sips` for readable still images. Crop to a unique temporary file in a `mktemp -d` directory with `sips -c "$side" "$side" "$source" --out "$temporary_square"`; **then, in a separate invocation**, `sips -z "$size" "$size" "$temporary_square" --out "$output"`. Keep the original format when writable; if `sips` cannot write it (notably WebP), explicitly convert the crop to PNG with `-s format png` and use `.png` for the temp and output. Keep alpha for formats that support it. Do not combine crop and resize flags: on 600x450 input, that produced 192x256. Resizing a rectangle directly squishes it.
4. Verify both `format` and exact dimensions with `sips -g format -g pixelWidth -g pixelHeight "$output"`; fix mismatched extension/format before reporting the path. Remove only the temporary file/directory you created. If a format fails to decode, use an installed image tool that supports it rather than silently skipping the image. For animated files or multi-page images, ask which frame/page to use rather than silently dropping content.
