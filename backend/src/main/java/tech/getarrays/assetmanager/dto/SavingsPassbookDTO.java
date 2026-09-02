package tech.getarrays.assetmanager.dto;

import lombok.Data;
import tech.getarrays.assetmanager.models.Asset;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class SavingsPassbookDTO {

    private Long id;

    private Long userId;

    private BigDecimal principalAmount;

    private String savingsPassbookNumber;

    private Integer depositTerm;

    private BigDecimal interestRate;

    private LocalDateTime maturityDate;

    private LocalDateTime withdrawalDate;

    private BigDecimal estimatedMaturityProceeds;

    private Asset.AssetType assetType;

    private LocalDateTime createdAt;

    private List<AdditionalDepositDTO> additionalDeposits;
}
