package tech.getarrays.assetmanager.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CashBalanceDTO {

    private Long id;

    private Long cashAssetId;

    private String currencyCode;

    private BigDecimal amount;
}
