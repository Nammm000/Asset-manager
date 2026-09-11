package tech.getarrays.assetmanager.repo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tech.getarrays.assetmanager.models.LandAsset;

import java.util.List;

@Repository
public interface LandAssetRepo extends JpaRepository<LandAsset, Long> {

    Page<LandAsset> findByUserId(Long userId, Pageable pageable);

    List<LandAsset> findByIdIn(List<Long> ids);
}