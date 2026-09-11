package tech.getarrays.assetmanager.repo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tech.getarrays.assetmanager.models.OtherAsset;

import java.util.List;

@Repository
public interface OtherAssetRepo extends JpaRepository<OtherAsset, Long> {

    Page<OtherAsset> findByUserId(Long userId, Pageable pageable);

    List<OtherAsset> findByIdIn(List<Long> ids);
}