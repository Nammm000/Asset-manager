package tech.getarrays.assetmanager.services.asset;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.getarrays.assetmanager.constants.AssetConstants;
import tech.getarrays.assetmanager.dto.AdditionalDepositRequestDTO;
import tech.getarrays.assetmanager.dto.SavingsPassbookDTO;
import tech.getarrays.assetmanager.exception.NotFoundException;
import tech.getarrays.assetmanager.models.AdditionalDeposit;
import tech.getarrays.assetmanager.models.SavingsPassbook;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.repo.AdditionalDepositRepo;
import tech.getarrays.assetmanager.repo.SavingsPassbookRepo;
import tech.getarrays.assetmanager.repo.UserRepo;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Service
public class AdditionalDepositService {

    SavingsPassbookRepo savingsPassbookRepo;
    AdditionalDepositRepo additionalDepositRepo;
    UserRepo userRepo;


    @Autowired
    public AdditionalDepositService(SavingsPassbookRepo theSavingsPassbookRepo,
                                    AdditionalDepositRepo theAdditionalDepositRepo,
                                    UserRepo theUserRepo) {
        savingsPassbookRepo = theSavingsPassbookRepo;
        additionalDepositRepo = theAdditionalDepositRepo;
        userRepo = theUserRepo;
    }

    @Transactional
    public ResponseEntity<SavingsPassbookDTO> deposit(AdditionalDepositRequestDTO requestDTO) {
        boolean hasEmail = requestDTO.getEmail() != null && !requestDTO.getEmail().isBlank();
        boolean hasPhone = requestDTO.getPhone() != null && !requestDTO.getPhone().isBlank();
        if (requestDTO.getAmount() == null || requestDTO.getAmount().compareTo(BigDecimal.ZERO) <= 0
                || requestDTO.getAccountNumber() == null || requestDTO.getAccountNumber().isBlank()
                || requestDTO.getSavingsPassbookNumber() == null || requestDTO.getSavingsPassbookNumber().isBlank()
                || (!hasEmail && !hasPhone)) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }

        User user = userRepo.findFirstByAccountNumber(requestDTO.getAccountNumber());
        if (user == null) {
            throw new NotFoundException("Account not found");
        }
        boolean emailMismatch = hasEmail && !requestDTO.getEmail().equalsIgnoreCase(user.getEmail());
        boolean phoneMismatch = hasPhone && !requestDTO.getPhone().equals(user.getPhone());
        if (emailMismatch || phoneMismatch) {
            throw new NotFoundException("Account does not have this email or phone number");
        }

        SavingsPassbook passbook = savingsPassbookRepo
                .findFirstBySavingsPassbookNumberAndUserId(requestDTO.getSavingsPassbookNumber(), user.getId())
                .orElseThrow(() -> new NotFoundException(
                        "Savings passbook '" + requestDTO.getSavingsPassbookNumber() + "' doesn't exist for this account"));

        AdditionalDeposit deposit = new AdditionalDeposit();
        deposit.setPassbook(passbook);
        BigDecimal amount = requestDTO.getAmount();
        deposit.setAmount(amount);
        deposit.setAdditionalDate(LocalDateTime.now());
        additionalDepositRepo.save(deposit);

        passbook.setPrincipalAmount(passbook.getPrincipalAmount().add(amount));
        savingsPassbookRepo.save(passbook);

        log.info("Additional deposit of {} recorded for passbook {} (user {})",
                requestDTO.getAmount(), requestDTO.getSavingsPassbookNumber(), user.getEmail());
        return new ResponseEntity<>(toDTO(passbook), HttpStatus.CREATED);
    }

    private SavingsPassbookDTO toDTO(SavingsPassbook passbook) {
        SavingsPassbookDTO dto = new SavingsPassbookDTO();
        dto.setId(passbook.getId());
        dto.setUserId(passbook.getUser().getId());
        dto.setPrincipalAmount(passbook.getPrincipalAmount());
        dto.setSavingsPassbookNumber(passbook.getSavingsPassbookNumber());
        dto.setInterestRate(passbook.getInterestRate());
        dto.setMaturityDate(passbook.getMaturityDate());
        dto.setWithdrawalDate(passbook.getWithdrawalDate());
        dto.setEstimatedMaturityProceeds(passbook.getEstimatedMaturityProceeds());
        dto.setAssetType(passbook.getAssetType());
        dto.setCreatedAt(passbook.getCreatedAt());
        return dto;
    }
}
