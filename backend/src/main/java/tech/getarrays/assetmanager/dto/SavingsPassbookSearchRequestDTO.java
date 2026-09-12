package tech.getarrays.assetmanager.dto;

import lombok.Data;

@Data
public class SavingsPassbookSearchRequestDTO {

    private String principalAmount;
    private String savingsPassbookName;
    private String depositTerm;
    private String interestRate;
    private String maturityDate;
    private String withdrawalDate;
    private String estimatedMaturityProceeds;
}
