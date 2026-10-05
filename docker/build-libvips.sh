#!/bin/sh
set -eu

# Sharp 0.35.5 requires a newer libvips than the base distributions provide.
# Keep the system codec libraries, including libheif for HEIC decoding.
libvips_version=8.18.7
libvips_sha256=5baaead3b0bb20ffdb9e9ff09aa9fda08620923df77b63b436654cb5e0b3bf94
libvips_build_dir=$(mktemp -d)
trap 'rm -rf "$libvips_build_dir"' EXIT HUP INT TERM

curl -fsSL --retry 3 \
  "https://github.com/libvips/libvips/releases/download/v${libvips_version}/vips-${libvips_version}.tar.xz" \
  -o "$libvips_build_dir/vips.tar.xz"
echo "$libvips_sha256  $libvips_build_dir/vips.tar.xz" | sha256sum -c -
tar -xJf "$libvips_build_dir/vips.tar.xz" -C "$libvips_build_dir"
meson setup "$libvips_build_dir/build" "$libvips_build_dir/vips-$libvips_version" \
  --prefix=/usr/local --libdir=lib --buildtype=release \
  -Dintrospection=disabled -Dvapi=false -Dexamples=false \
  -Dheif=enabled -Dmagick=enabled
meson compile -C "$libvips_build_dir/build" -j 4
meson install -C "$libvips_build_dir/build"
