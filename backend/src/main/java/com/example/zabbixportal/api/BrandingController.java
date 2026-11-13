package com.example.zabbixportal.api;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.zabbixportal.config.BrandingProperties;

/** Public (no sign-in needed): the portal's title, colours and logo from the configuration. */
@RestController
@RequestMapping("/api/branding")
public class BrandingController {

    private static final long MAX_LOGO_BYTES = 1024 * 1024;

    private final BrandingProperties branding;

    public BrandingController(BrandingProperties branding) {
        this.branding = branding;
    }

    public record BrandingInfo(String title, boolean logo, String primaryColor, String accentColor) {
    }

    @GetMapping
    public BrandingInfo info() {
        return new BrandingInfo(branding.title(), readableLogo() != null, branding.primaryColor(), branding.accentColor());
    }

    @GetMapping("/logo")
    public ResponseEntity<byte[]> logo() throws IOException {
        Path file = readableLogo();
        if (file == null) {
            return ResponseEntity.notFound().build();
        }
        String name = file.getFileName().toString().toLowerCase();
        MediaType type = name.endsWith(".svg") ? MediaType.valueOf("image/svg+xml")
                : name.endsWith(".png") ? MediaType.IMAGE_PNG
                : name.endsWith(".jpg") || name.endsWith(".jpeg") ? MediaType.IMAGE_JPEG
                : null;
        if (type == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(type).body(Files.readAllBytes(file));
    }

    private Path readableLogo() {
        if (branding.logoFile() == null) {
            return null;
        }
        try {
            Path file = Path.of(branding.logoFile());
            return Files.isRegularFile(file) && Files.isReadable(file) && Files.size(file) <= MAX_LOGO_BYTES ? file : null;
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }
}
