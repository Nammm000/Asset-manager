package tech.getarrays.assetmanager.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class AdditionalDepositRequestDTO {

    private String email;

    private String phone;

    private String accountNumber;

    private String savingsPassbookNumber;

    private BigDecimal amount;
}
