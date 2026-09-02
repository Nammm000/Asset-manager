package tech.getarrays.assetmanager.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "savings_passbooks")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SavingsPassbook extends Asset {

    @Column(name = "principal_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal principalAmount;

    @Column(name = "savings_passbook_number", nullable = false, unique = true, length = 50)
    private String savingsPassbookNumber;

    @Column(name = "deposit_term", nullable = false)
    private Integer depositTerm;

    @Column(name = "interest_rate", nullable = false, precision = 8, scale = 4)
    private BigDecimal interestRate;

    @Column(name = "maturity_date", nullable = false)
    private LocalDateTime maturityDate;

    @Column(name = "withdrawal_date")
    private LocalDateTime withdrawalDate;

    @Column(
            name = "estimated_maturity_proceeds",
            precision = 19,
            scale = 2
    )
    private BigDecimal estimatedMaturityProceeds;

    @OneToMany(
            mappedBy = "passbook",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @Builder.Default
    private List<AdditionalDeposit> additionalDeposits = new ArrayList<>();

    @PrePersist
    protected void setAssetType() {
        setAssetType(AssetType.SAVINGS_PASSBOOK);
    }
}
