package tech.getarrays.assetmanager.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class AdditionalDepositDTO {

    private Long id;

    private BigDecimal amount;

    private LocalDateTime additionalDate;
}
