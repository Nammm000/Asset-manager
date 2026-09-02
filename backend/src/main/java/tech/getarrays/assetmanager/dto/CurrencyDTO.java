package tech.getarrays.assetmanager.dto;

import lombok.Data;

@Data
public class CurrencyDTO {

    private String code;

    private String name;

    private String symbol;

    private Integer decimalPlaces;
}