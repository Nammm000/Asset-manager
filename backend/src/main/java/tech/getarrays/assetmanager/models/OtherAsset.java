package tech.getarrays.assetmanager.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "other_assets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OtherAsset extends Asset {

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(name = "price_per_unit", nullable = false, precision = 19, scale = 2)
    private BigDecimal pricePerUnit;

    @PrePersist
    protected void setAssetType() {
        setAssetType(AssetType.OTHER);
    }
}