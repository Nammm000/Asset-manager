package tech.getarrays.assetmanager.services.asset;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.getarrays.assetmanager.constants.AssetConstants;
import tech.getarrays.assetmanager.dto.BulkDeleteRequestDTO;
import tech.getarrays.assetmanager.dto.CashAssetDTO;
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
import java.util.List;

@Slf4j
@Service
public class CashAssetService {

    CashAssetRepo cashAssetRepo;
    CashBalanceRepo cashBalanceRepo;
    CurrencyRepo currencyRepo;

    @Autowired
    public CashAssetService(CashBalanceRepo theCashBalanceRepo,CashAssetRepo theCashAssetRepo,
                            CurrencyRepo theCurrencyRepo) {
        cashBalanceRepo = theCashBalanceRepo;
        cashAssetRepo = theCashAssetRepo;
        currencyRepo = theCurrencyRepo;
    }

    public ResponseEntity<PagedResponseDTO<CashAssetDTO>> getMyCashAssets(int page, int size) {
        User user = UserUtils.getCurrentUser();
        Page<CashAssetDTO> assets = cashAssetRepo
                .findByUserId(user.getId(), PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(this::toDTO);
        return new ResponseEntity<>(PagedResponseDTO.from(assets), HttpStatus.OK);
    }

    public ResponseEntity<CashAssetDTO> getCashAsset(Long id) {
        CashAsset asset = cashAssetRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Cash asset id " + id + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        return new ResponseEntity<>(toDTO(asset), HttpStatus.OK);
    }

    public ResponseEntity<CashAssetDTO> createCashAsset(CashAssetDTO dto) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        User user = UserUtils.getCurrentUser();
        CashAsset asset = new CashAsset();
        asset.setUser(user);
        asset.setName(dto.getName());
        asset.setDescription(dto.getDescription());
//        List<CashAsset> assets = cashAssetRepo.findByUserIdOrderByIdAsc(user.getId());
//        if (assets.isEmpty()) {
//            asset = new CashAsset();
//            asset.setUser(user);
//        } else {
//            asset = assets.get(0);
//        }
//        Currency currency = currencyRepo.findById(dto.getCurrencyCode())
//                .orElseThrow(() -> new NotFoundException("Currency '" + dto.getCurrencyCode() + "' doesn't exist"));
//        CashBalance balance = asset.getBalances().stream()
//                .filter(b -> b.getCurrency().getCode().equals(currency.getCode()))
//                .findFirst()
//                .orElse(null);
//        if (balance != null) {
//            balance.setAmount(balance.getAmount().add(dto.getAmount()));
//        } else {
//            asset.getBalances().add(CashBalance.builder()
//                    .cashAsset(asset)
//                    .currency(currency)
//                    .amount(dto.getAmount())
//                    .build());
//        }
        CashAsset saved = cashAssetRepo.save(asset);
        return new ResponseEntity<>(toDTO(saved), HttpStatus.CREATED);
    }

//    @Transactional
//    public ResponseEntity<CashAssetDTO> addCashAsset(Long id, CashBalanceDTO dto) {
//        if (dto.getCurrencyCode() == null || dto.getCurrencyCode().isBlank()
//                || dto.getAmount() == null) {
//            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
//        }
//        CashAsset asset = cashAssetRepo.findById(id)
//                .orElseThrow(() -> new NotFoundException("Cash asset id " + id + " doesn't exist"));
//        UserUtils.checkOwnership(asset);
//        Currency currency = currencyRepo.findById(dto.getCurrencyCode())
//                .orElseThrow(() -> new NotFoundException("Currency '" + dto.getCurrencyCode() + "' doesn't exist"));
//        CashBalance balance = asset.getBalances().stream()
//                .filter(b -> b.getCurrency().getCode().equals(currency.getCode()))
//                .findFirst()
//                .orElse(null);
//        if (balance != null) {
//            balance.setAmount(balance.getAmount().add(dto.getAmount()));
//        } else {
//            asset.getBalances().add(CashBalance.builder()
//                    .cashAsset(asset)
//                    .currency(currency)
//                    .amount(dto.getAmount())
//                    .build());
//        }
//        CashAsset saved = cashAssetRepo.saveAndFlush(asset);
//        return new ResponseEntity<>(toDTO(saved), HttpStatus.CREATED);
//    }

    public ResponseEntity<String> deleteCashAsset(Long id) {
        CashAsset asset = cashAssetRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Cash asset id " + id + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        cashAssetRepo.delete(asset);
        return AssetUtils.getResponseEntity("Cash asset deleted successfully", HttpStatus.OK);
    }

    // deleteAll (not deleteAllInBatch) so balances cascade with the wallets
    @Transactional
    public ResponseEntity<String> deleteCashAssets(BulkDeleteRequestDTO request) {
        List<Long> ids = request.getIds();
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        List<Long> distinctIds = ids.stream().distinct().toList();
        List<CashAsset> assets = cashAssetRepo.findByIdIn(distinctIds);
        if (assets.size() != distinctIds.size()) {
            throw new NotFoundException("One or more cash assets don't exist");
        }
        assets.forEach(UserUtils::checkOwnership);
        cashAssetRepo.deleteAll(assets);
        return AssetUtils.getResponseEntity("Cash assets deleted successfully", HttpStatus.OK);
    }

    private CashAssetDTO toDTO(CashAsset asset) {
        CashAssetDTO dto = new CashAssetDTO();
        dto.setId(asset.getId());
        dto.setName(asset.getName());
        dto.setDescription(asset.getDescription());
        dto.setUserId(asset.getUser().getId());
        dto.setAssetType(asset.getAssetType());
        dto.setCreatedAt(asset.getCreatedAt());
        dto.setBalances(asset.getBalances().stream().map(this::toBalanceDTO).toList());
        return dto;
    }

    private CashBalanceDTO toBalanceDTO(CashBalance balance) {
        CashBalanceDTO dto = new CashBalanceDTO();
        dto.setId(balance.getId());
        dto.setCashAssetId(balance.getCashAsset().getId());
        dto.setCurrencyCode(balance.getCurrency().getCode());
        dto.setAmount(balance.getAmount());
        return dto;
    }
}
