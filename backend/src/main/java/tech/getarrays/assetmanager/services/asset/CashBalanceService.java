package tech.getarrays.assetmanager.services.asset;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import tech.getarrays.assetmanager.constants.AssetConstants;
import tech.getarrays.assetmanager.dto.CashBalanceDTO;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.exception.NotFoundException;
import tech.getarrays.assetmanager.models.CashAsset;
import tech.getarrays.assetmanager.models.CashBalance;
import tech.getarrays.assetmanager.models.Currency;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.repo.CashAssetRepo;
import tech.getarrays.assetmanager.repo.CashBalanceRepo;
import tech.getarrays.assetmanager.repo.CurrencyRepo;
import tech.getarrays.assetmanager.util.AssetUtils;
import tech.getarrays.assetmanager.util.UserUtils;

import java.math.BigDecimal;
import java.util.Objects;

@Slf4j
@Service
public class CashBalanceService {

    CashBalanceRepo cashBalanceRepo;
    CashAssetRepo cashAssetRepo;
    CurrencyRepo currencyRepo;

    @Autowired
    public CashBalanceService(CashBalanceRepo theCashBalanceRepo, CashAssetRepo theCashAssetRepo,
                              CurrencyRepo theCurrencyRepo) {
        cashBalanceRepo = theCashBalanceRepo;
        cashAssetRepo = theCashAssetRepo;
        currencyRepo = theCurrencyRepo;
    }

    public ResponseEntity<PagedResponseDTO<CashBalanceDTO>> getMyCashBalances(Long cashAssetId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        Page<CashBalance> balances;
        if (cashAssetId != null) {
            CashAsset asset = cashAssetRepo.findById(cashAssetId)
                    .orElseThrow(() -> new NotFoundException("Cash asset id " + cashAssetId + " doesn't exist"));
            UserUtils.checkOwnership(asset);
            balances = cashBalanceRepo.findByCashAssetId(cashAssetId, pageable);
        } else {
            User user = UserUtils.getCurrentUser();
            balances = cashBalanceRepo.findByCashAssetUserId(user.getId(), pageable);
        }
        return new ResponseEntity<>(PagedResponseDTO.from(balances.map(this::toDTO)), HttpStatus.OK);
    }

    public ResponseEntity<CashBalanceDTO> getCashBalance(Long id) {
        CashBalance balance = cashBalanceRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Cash balance id " + id + " doesn't exist"));
        UserUtils.checkOwnership(balance.getCashAsset());
        return new ResponseEntity<>(toDTO(balance), HttpStatus.OK);
    }

    public ResponseEntity<CashBalanceDTO> createCashBalance(CashBalanceDTO balanceDTO) {
        BigDecimal amount = balanceDTO.getAmount();
        if (balanceDTO.getCashAssetId() == null
                || balanceDTO.getCurrencyCode() == null || balanceDTO.getCurrencyCode().isBlank()
                || amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        CashAsset asset = cashAssetRepo.findById(balanceDTO.getCashAssetId())
                .orElseThrow(() -> new NotFoundException("Cash asset id " + balanceDTO.getCashAssetId() + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        Currency currency = currencyRepo.findById(balanceDTO.getCurrencyCode())
                .orElseThrow(() -> new NotFoundException("Currency '" + balanceDTO.getCurrencyCode() + "' doesn't exist"));
//        if (cashBalanceRepo.existsByCashAssetIdAndCurrencyCode(asset.getId(), currency.getCode())) {
//            throw new ConflictException("Balance for currency '" + currency.getCode() + "' already exists in this cash asset");
//        }
        CashBalance balance = new CashBalance();
        balance.setCashAsset(asset);
        balance.setCurrency(currency);
        balance.setAmount(amount);
        CashBalance saved = cashBalanceRepo.save(balance);
        return new ResponseEntity<>(toDTO(saved), HttpStatus.CREATED);
    }

    @Transactional
    public ResponseEntity<CashBalanceDTO> addOrSubtractCashBalance(Long id, CashBalanceDTO balanceDTO) {
        BigDecimal amount = balanceDTO.getAmount();
        if (balanceDTO.getCashAssetId() == null
                || balanceDTO.getCurrencyCode() == null || balanceDTO.getCurrencyCode().isBlank()
                || amount == null) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        CashBalance balance = cashBalanceRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Cash balance id " + id + " doesn't exist"));

        if(!Objects.equals(balance.getCurrency().getCode(), balanceDTO.getCurrencyCode())) {
            throw new IllegalArgumentException("Wrong Currency Code.");
        }
        balance.setAmount(balance.getAmount().add(amount));
        CashBalance saved = cashBalanceRepo.save(balance);
        return new ResponseEntity<>(toDTO(saved), HttpStatus.CREATED);
    }

    public ResponseEntity<CashBalanceDTO> updateCashBalance(Long id, CashBalanceDTO balanceDTO) {
        CashBalance balance = cashBalanceRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Cash balance id " + id + " doesn't exist"));
        UserUtils.checkOwnership(balance.getCashAsset());
        if (balanceDTO.getAmount() != null) {
            if (balanceDTO.getAmount().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
            }
            balance.setAmount(balanceDTO.getAmount());
        }
        cashBalanceRepo.save(balance);
        return new ResponseEntity<>(toDTO(balance), HttpStatus.OK);
    }

    public ResponseEntity<String> deleteCashBalance(Long id) {
        CashBalance balance = cashBalanceRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Cash balance id " + id + " doesn't exist"));
        UserUtils.checkOwnership(balance.getCashAsset());
        cashBalanceRepo.delete(balance);
        return AssetUtils.getResponseEntity("Cash balance deleted successfully", HttpStatus.OK);
    }

    private CashBalanceDTO toDTO(CashBalance balance) {
        CashBalanceDTO dto = new CashBalanceDTO();
        dto.setId(balance.getId());
        dto.setCashAssetId(balance.getCashAsset().getId());
        dto.setCurrencyCode(balance.getCurrency().getCode());
        dto.setAmount(balance.getAmount());
        return dto;
    }
}
