package tech.getarrays.assetmanager.dto;

import lombok.Data;
import tech.getarrays.assetmanager.models.Asset;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class LandAssetDTO {

    private Long id;

    private Long userId;

    private String location;

    private BigDecimal area;

    private LocalDateTime purchaseDate;

    private LocalDateTime saleDate;

    private Asset.AssetType assetType;

    private LocalDateTime createdAt;
}