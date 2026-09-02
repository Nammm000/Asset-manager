package tech.getarrays.assetmanager.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cash_assets")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashAsset extends Asset {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 100)
    private String description;

    @OneToMany(
            mappedBy = "cashAsset",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @Builder.Default
    private List<CashBalance> balances = new ArrayList<>();

    @PrePersist
    protected void setAssetType() {
        setAssetType(AssetType.CASH);
    }
}