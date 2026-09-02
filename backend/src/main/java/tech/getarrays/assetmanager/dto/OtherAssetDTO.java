package tech.getarrays.assetmanager.dto;

import lombok.Data;
import tech.getarrays.assetmanager.models.Asset;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class OtherAssetDTO {

    private Long id;

    private Long userId;

    private String name;

    private BigDecimal amount;

    private BigDecimal pricePerUnit;

    private Asset.AssetType assetType;

    private LocalDateTime createdAt;
}