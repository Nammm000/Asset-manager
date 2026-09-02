package tech.getarrays.assetmanager.repo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tech.getarrays.assetmanager.models.CashBalance;

@Repository
public interface CashBalanceRepo extends JpaRepository<CashBalance, Long> {

    Page<CashBalance> findByCashAssetUserId(Long userId, Pageable pageable);

    Page<CashBalance> findByCashAssetId(Long cashAssetId, Pageable pageable);

    boolean existsByCashAssetIdAndCurrencyCode(Long cashAssetId, String currencyCode);
}
