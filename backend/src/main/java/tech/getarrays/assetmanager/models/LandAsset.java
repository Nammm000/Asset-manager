package tech.getarrays.assetmanager.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "land_assets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LandAsset extends Asset {

    @Column(nullable = false, length = 500)
    private String location;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal area;

    @Column(name = "purchase_date", nullable = false)
    private LocalDateTime purchaseDate;

    @Column(name = "sale_date")
    private LocalDateTime saleDate;

    @PrePersist
    protected void setAssetType() {
        setAssetType(AssetType.LAND);
    }
}
