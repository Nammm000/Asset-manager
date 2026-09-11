package tech.getarrays.assetmanager.repo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tech.getarrays.assetmanager.models.CashAsset;

import java.util.List;

@Repository
public interface CashAssetRepo extends JpaRepository<CashAsset, Long> {

    Page<CashAsset> findByUserId(Long userId, Pageable pageable);

    List<CashAsset> findByIdIn(List<Long> ids);
}
