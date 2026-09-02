package tech.getarrays.assetmanager.dto;

import lombok.Data;
import tech.getarrays.assetmanager.models.Asset;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CashAssetDTO {

    private Long id;

    private String name;

    private String description;

    private Long userId;

    private Asset.AssetType assetType;

    private LocalDateTime createdAt;

    private List<CashBalanceDTO> balances;
}
