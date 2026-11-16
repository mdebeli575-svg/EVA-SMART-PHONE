package com.evamobile.seed;

import com.evamobile.domain.Category;
import com.evamobile.domain.Product;
import com.evamobile.repo.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final ProductRepository products;

    public DataSeeder(ProductRepository products) {
        this.products = products;
    }

    @Override
    public void run(String... args) {
        if (products.count() > 0) {
            return;
        }

        products.saveAll(List.of(
                phone("Samsung Galaxy S24 Ultra", "Samsung", "120000", 6, true, "#3d4db7",
                        "6.8\" QHD+ AMOLED, 200MP camera, S Pen, 12GB RAM, 256GB. Sealed box with local warranty."),
                phone("iPhone 15 Pro Max", "Apple", "150000", 4, true, "#5b6472",
                        "6.7\" Super Retina XDR, A17 Pro, 256GB, titanium finish. Sealed box, full warranty."),
                phone("iPhone 13 128GB", "Apple", "95000", 7, false, "#1f2937",
                        "6.1\" OLED, A15 Bionic, dual 12MP camera. A dependable everyday iPhone."),
                phone("Samsung Galaxy A55", "Samsung", "42000", 12, true, "#2563eb",
                        "6.6\" Super AMOLED 120Hz, 50MP OIS camera, 8GB RAM, 5000mAh battery."),
                phone("Redmi Note 13 Pro", "Xiaomi", "26500", 15, false, "#059669",
                        "200MP camera, 67W turbo charging, 120Hz AMOLED display, 8GB + 256GB."),
                phone("Tecno Camon 30", "Tecno", "21500", 9, false, "#7c3aed",
                        "50MP Sony sensor, 70W fast charge, 6.78\" AMOLED, 8GB + 256GB."),
                phone("Infinix Hot 50", "Infinix", "17500", 11, false, "#ea580c",
                        "6.7\" 120Hz display, 5000mAh battery, 8GB RAM + 128GB storage."),
                phone("Nokia 105 (2024)", "Nokia", "3200", 25, false, "#0891b2",
                        "Reliable keypad phone with long battery life. Perfect backup device."),

                accessory("Anker 20,000mAh Power Bank", "Anker", "3400", 18, true, "#0f172a",
                        "Two-device fast charging, USB-C in/out, airline safe."),
                accessory("65W GaN Fast Charger", "Baseus", "2300", 22, false, "#475569",
                        "Compact GaN charger with USB-C PD and USB-A ports."),
                accessory("Wireless Earbuds Pro", "Generic", "4200", 14, true, "#9333ea",
                        "Active noise cancelling, 30-hour case battery, Bluetooth 5.3."),
                accessory("Smart Watch Fit 3", "Generic", "6800", 8, false, "#0d9488",
                        "AMOLED display, heart-rate and SpO2 tracking, 7-day battery."),
                accessory("Silicone Back Cover", "Generic", "700", 40, false, "#db2777",
                        "Soft-touch protective cover with raised camera lip."),
                accessory("Tempered Glass Protector", "Generic", "400", 60, false, "#64748b",
                        "9H hardness, full-screen coverage, easy dust-free install."),
                accessory("Braided USB-C Cable 2m", "Generic", "550", 35, false, "#b45309",
                        "60W rated braided cable for charging and data transfer.")
        ));

        log.info("Seeded {} products for Eva Mobile", products.count());
    }

    private Product phone(String name, String brand, String price, int stock, boolean featured,
                          String color, String description) {
        return build(name, brand, Category.SMARTPHONE, price, stock, featured, color, description);
    }

    private Product accessory(String name, String brand, String price, int stock, boolean featured,
                              String color, String description) {
        return build(name, brand, Category.ACCESSORY, price, stock, featured, color, description);
    }

    private Product build(String name, String brand, Category category, String price, int stock,
                          boolean featured, String color, String description) {
        Product p = new Product();
        p.setName(name);
        p.setBrand(brand);
        p.setCategory(category);
        p.setPrice(new BigDecimal(price));
        p.setStock(stock);
        p.setFeatured(featured);
        p.setColor(color);
        p.setDescription(description);
        p.setActive(true);
        return p;
    }
}
