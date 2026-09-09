package tech.getarrays.assetmanager.services.asset;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import tech.getarrays.assetmanager.constants.AssetConstants;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.dto.SavingsPassbookDTO;
import tech.getarrays.assetmanager.exception.NotFoundException;
import tech.getarrays.assetmanager.models.AdditionalDeposit;
import tech.getarrays.assetmanager.models.SavingsPassbook;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.repo.AdditionalDepositRepo;
import tech.getarrays.assetmanager.repo.SavingsPassbookRepo;
import tech.getarrays.assetmanager.util.AssetUtils;
import tech.getarrays.assetmanager.util.UserUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;


@Slf4j
@Service
public class SavingsPassbookService {

    SavingsPassbookRepo savingsPassbookRepo;
    AdditionalDepositRepo additionalDepositRepo;

    @Autowired
    public SavingsPassbookService(SavingsPassbookRepo theSavingsPassbookRepo,
                                  AdditionalDepositRepo theAdditionalDepositRepo) {
        savingsPassbookRepo = theSavingsPassbookRepo;
        additionalDepositRepo = theAdditionalDepositRepo;
    }

    public ResponseEntity<PagedResponseDTO<SavingsPassbookDTO>> getMySavingsPassbooks(int page, int size) {
        User user = UserUtils.getCurrentUser();
        Page<SavingsPassbookDTO> passbooks = savingsPassbookRepo
                .findByUserId(user.getId(), PageRequest.of(page, size))
                .map(this::toDTO);
        return new ResponseEntity<>(PagedResponseDTO.from(passbooks), HttpStatus.OK);
    }

    public ResponseEntity<SavingsPassbookDTO> getSavingsPassbook(Long id) {
        SavingsPassbook passbook = savingsPassbookRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Savings passbook id " + id + " doesn't exist"));
        UserUtils.checkOwnership(passbook);
        return new ResponseEntity<>(toDTO(passbook), HttpStatus.OK);
    }

    public ResponseEntity<SavingsPassbookDTO> createSavingsPassbook(SavingsPassbookDTO passbookDTO) {
        BigDecimal principalAmount = passbookDTO.getPrincipalAmount();
        if (principalAmount == null
                || principalAmount.compareTo(BigDecimal.ZERO) <= 0
                || passbookDTO.getInterestRate() == null
                || passbookDTO.getMaturityDate() == null) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        User user = UserUtils.getCurrentUser();
        SavingsPassbook passbook = new SavingsPassbook();
        passbook.setUser(user);
        if (passbookDTO.getCreatedAt() != null) {
            passbook.setCreatedAt(passbookDTO.getCreatedAt());
        }
        if (passbookDTO.getSavingsPassbookName() != null) {
            passbook.setSavingsPassbookName(passbookDTO.getSavingsPassbookName());
        }
        passbook.setPrincipalAmount(principalAmount);
        passbook.setSavingsPassbookNumber("PBN-" + UUID.randomUUID());
        passbook.setDepositTerm(passbookDTO.getDepositTerm());
        passbook.setInterestRate(passbookDTO.getInterestRate());
        passbook.setMaturityDate(passbookDTO.getMaturityDate());
        passbook.setWithdrawalDate(null);
        passbook.setEstimatedMaturityProceeds(passbookDTO.getEstimatedMaturityProceeds());
        SavingsPassbook saved = savingsPassbookRepo.save(passbook);

        AdditionalDeposit deposit = new AdditionalDeposit();
        deposit.setPassbook(saved);
        deposit.setAmount(saved.getPrincipalAmount());
        deposit.setAdditionalDate(LocalDateTime.now());
        additionalDepositRepo.save(deposit);

        return new ResponseEntity<>(toDTO(saved), HttpStatus.CREATED);
    }

    public ResponseEntity<SavingsPassbookDTO> updateSavingsPassbook(Long id, SavingsPassbookDTO passbookDTO) {
        SavingsPassbook passbook = savingsPassbookRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Savings passbook id " + id + " doesn't exist"));
        UserUtils.checkOwnership(passbook);
        if (passbookDTO.getPrincipalAmount() != null) {
            passbook.setPrincipalAmount(passbookDTO.getPrincipalAmount());
        }
        if (passbookDTO.getDepositTerm() != null) {
            passbook.setDepositTerm(passbookDTO.getDepositTerm());
        }
        if (passbookDTO.getInterestRate() != null) {
            passbook.setInterestRate(passbookDTO.getInterestRate());
        }
        if (passbookDTO.getMaturityDate() != null) {
            passbook.setMaturityDate(passbookDTO.getMaturityDate());
        }
        if (passbookDTO.getWithdrawalDate() != null) {
            passbook.setWithdrawalDate(passbookDTO.getWithdrawalDate());
        }
        if (passbookDTO.getEstimatedMaturityProceeds() != null) {
            passbook.setEstimatedMaturityProceeds(passbookDTO.getEstimatedMaturityProceeds());
        }
        savingsPassbookRepo.save(passbook);
        return new ResponseEntity<>(toDTO(passbook), HttpStatus.OK);
    }

    public ResponseEntity<String> deleteSavingsPassbook(Long id) {
        SavingsPassbook passbook = savingsPassbookRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Savings passbook id " + id + " doesn't exist"));
        UserUtils.checkOwnership(passbook);
        savingsPassbookRepo.delete(passbook);
        return AssetUtils.getResponseEntity("Savings passbook deleted successfully", HttpStatus.OK);
    }

    private SavingsPassbookDTO toDTO(SavingsPassbook passbook) {
        SavingsPassbookDTO dto = new SavingsPassbookDTO();
        dto.setId(passbook.getId());
        dto.setUserId(passbook.getUser().getId());
        dto.setPrincipalAmount(passbook.getPrincipalAmount());
        dto.setSavingsPassbookName(passbook.getSavingsPassbookName());
        dto.setSavingsPassbookNumber(passbook.getSavingsPassbookNumber());
        dto.setDepositTerm(passbook.getDepositTerm());
        dto.setInterestRate(passbook.getInterestRate());
        dto.setMaturityDate(passbook.getMaturityDate());
        dto.setWithdrawalDate(passbook.getWithdrawalDate());
        dto.setEstimatedMaturityProceeds(passbook.getEstimatedMaturityProceeds());
        dto.setAssetType(passbook.getAssetType());
        dto.setCreatedAt(passbook.getCreatedAt());
        return dto;
    }
}
