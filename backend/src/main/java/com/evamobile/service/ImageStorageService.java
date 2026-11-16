package com.evamobile.service;

import com.evamobile.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Stores product photos under {@code eva.uploads.dir} and returns the public
 * path (served by the /uploads/** static handler).
 *
 * <p>JPEG/PNG uploads are centre-cropped to the 4:3 shape the storefront card
 * uses and resized to at most 1200 px wide, so owners never have to pre-edit
 * their photos. GIF and WebP are stored untouched (ImageIO has no WebP reader
 * on Java 17, and flattening a GIF would kill its animation).</p>
 */
@Service
public class ImageStorageService {

    private static final Logger log = LoggerFactory.getLogger(ImageStorageService.class);
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final int MAX_WIDTH = 1200;
    private static final double CARD_RATIO = 4.0 / 3.0;
    private static final int MAX_SOURCE_PIXELS = 40_000_000;

    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "image/gif", "gif"
    );

    private final Path root;

    public ImageStorageService(@Value("${eva.uploads.dir:./uploads}") String directory) {
        this.root = Paths.get(directory).toAbsolutePath().normalize();
    }

    public String storeProductImage(Long productId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Choose an image file to upload.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("Image must be 5 MB or smaller.");
        }
        String contentType = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String extension = EXTENSIONS.get(contentType);
        if (extension == null) {
            // Some browsers send application/octet-stream; fall back to the file name.
            extension = extensionFromName(file.getOriginalFilename());
        }
        if (extension == null) {
            throw ApiException.badRequest("Only JPEG, PNG, WebP or GIF images are allowed.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            log.error("Could not read uploaded image", e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read the image. Please try again.");
        }

        Prepared prepared = prepare(bytes, extension);

        String filename = "product-" + productId + "-"
                + UUID.randomUUID().toString().substring(0, 8) + "." + prepared.extension;
        Path folder = root.resolve("products");
        try {
            Files.createDirectories(folder);
            Path target = folder.resolve(filename).normalize();
            if (!target.startsWith(folder)) {
                throw ApiException.badRequest("Invalid file name.");
            }
            Files.write(target, prepared.bytes);
        } catch (IOException e) {
            log.error("Could not store product image", e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the image. Please try again.");
        }
        return "/uploads/products/" + filename;
    }

    /** Removes a previously stored upload, ignoring anything that is not ours. */
    public void deleteQuietly(String publicPath) {
        if (publicPath == null || !publicPath.startsWith("/uploads/")) {
            return;
        }
        String relative = publicPath.substring("/uploads/".length());
        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            log.warn("Could not delete old image {}", target, e);
        }
    }

    private Prepared prepare(byte[] bytes, String extension) {
        if (!"jpg".equals(extension) && !"png".equals(extension)) {
            return new Prepared(bytes, extension);
        }

        BufferedImage source;
        try {
            source = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException e) {
            source = null;
        }
        if (source == null) {
            throw ApiException.badRequest("That file could not be read as an image. Try another photo.");
        }
        long pixels = (long) source.getWidth() * source.getHeight();
        if (pixels > MAX_SOURCE_PIXELS) {
            throw ApiException.badRequest("Image dimensions are too large. Please use a smaller photo.");
        }

        double ratio = (double) source.getWidth() / source.getHeight();
        int cropWidth;
        int cropHeight;
        if (ratio > CARD_RATIO) {
            cropHeight = source.getHeight();
            cropWidth = (int) Math.round(cropHeight * CARD_RATIO);
        } else {
            cropWidth = source.getWidth();
            cropHeight = (int) Math.round(cropWidth / CARD_RATIO);
        }
        int x = (source.getWidth() - cropWidth) / 2;
        int y = (source.getHeight() - cropHeight) / 2;

        int outWidth = Math.min(cropWidth, MAX_WIDTH);
        int outHeight = Math.max(1, (int) Math.round(outWidth / CARD_RATIO));

        BufferedImage output = new BufferedImage(outWidth, outHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = output.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, outWidth, outHeight);
            graphics.drawImage(source, 0, 0, outWidth, outHeight,
                    x, y, x + cropWidth, y + cropHeight, null);
        } finally {
            graphics.dispose();
        }

        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            if (!ImageIO.write(output, "jpg", buffer)) {
                throw ApiException.badRequest("That image format could not be processed.");
            }
            return new Prepared(buffer.toByteArray(), "jpg");
        } catch (IOException e) {
            log.error("Could not encode product image", e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not process the image. Please try again.");
        }
    }

    private String extensionFromName(String name) {
        if (name == null) return null;
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
        if (lower.endsWith(".png")) return "png";
        if (lower.endsWith(".webp")) return "webp";
        if (lower.endsWith(".gif")) return "gif";
        return null;
    }

    private record Prepared(byte[] bytes, String extension) {
    }
}
