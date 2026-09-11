package tech.getarrays.assetmanager.services.asset;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import tech.getarrays.assetmanager.configuration.RequestSecurityContext;
import tech.getarrays.assetmanager.constants.AssetConstants;
import tech.getarrays.assetmanager.dto.BulkDeleteRequestDTO;
import tech.getarrays.assetmanager.dto.LandAssetDTO;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.exception.NotFoundException;
import tech.getarrays.assetmanager.models.LandAsset;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.repo.LandAssetRepo;
import tech.getarrays.assetmanager.util.AssetUtils;
import tech.getarrays.assetmanager.util.UserUtils;

import java.util.List;

@Slf4j
@Service
public class LandAssetService {

    LandAssetRepo landAssetRepo;

    @Autowired
    public LandAssetService(LandAssetRepo theLandAssetRepo) {
        landAssetRepo = theLandAssetRepo;
    }

    public ResponseEntity<PagedResponseDTO<LandAssetDTO>> getMyLandAssets(int page, int size) {
        User user = UserUtils.getCurrentUser();
        Page<LandAssetDTO> assets = landAssetRepo
                .findByUserId(user.getId(), PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(this::toDTO);
        return new ResponseEntity<>(PagedResponseDTO.from(assets), HttpStatus.OK);
    }

    public ResponseEntity<LandAssetDTO> getLandAsset(Long id) {
        LandAsset asset = landAssetRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Land asset id " + id + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        return new ResponseEntity<>(toDTO(asset), HttpStatus.OK);
    }

    public ResponseEntity<LandAssetDTO> createLandAsset(LandAssetDTO assetDTO) {
        if (assetDTO.getLocation() == null || assetDTO.getLocation().isBlank()
                || assetDTO.getArea() == null
                || assetDTO.getPurchaseDate() == null) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        User user = UserUtils.getCurrentUser();
        LandAsset asset = new LandAsset();
        asset.setUser(user);
        asset.setLocation(assetDTO.getLocation());
        asset.setArea(assetDTO.getArea());
        asset.setPurchaseDate(assetDTO.getPurchaseDate());
        asset.setSaleDate(null);
        LandAsset saved = landAssetRepo.save(asset);
        return new ResponseEntity<>(toDTO(saved), HttpStatus.CREATED);
    }

    public ResponseEntity<LandAssetDTO> updateLandAsset(Long id, LandAssetDTO assetDTO) {
        LandAsset asset = landAssetRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Land asset id " + id + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        if (assetDTO.getLocation() != null) {
            asset.setLocation(assetDTO.getLocation());
        }
        if (assetDTO.getArea() != null) {
            asset.setArea(assetDTO.getArea());
        }
        if (assetDTO.getPurchaseDate() != null) {
            asset.setPurchaseDate(assetDTO.getPurchaseDate());
        }
        if (assetDTO.getSaleDate() != null) {
            asset.setSaleDate(assetDTO.getSaleDate());
        }
        landAssetRepo.save(asset);
        return new ResponseEntity<>(toDTO(asset), HttpStatus.OK);
    }

    public ResponseEntity<String> deleteLandAsset(Long id) {
        LandAsset asset = landAssetRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Land asset id " + id + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        landAssetRepo.delete(asset);
        return AssetUtils.getResponseEntity("Land asset deleted successfully", HttpStatus.OK);
    }

    @Transactional
    public ResponseEntity<String> deleteLandAssets(BulkDeleteRequestDTO request) {
        List<Long> ids = request.getIds();
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        List<Long> distinctIds = ids.stream().distinct().toList();
        List<LandAsset> assets = landAssetRepo.findByIdIn(distinctIds);
        if (assets.size() != distinctIds.size()) {
            throw new NotFoundException("One or more land assets don't exist");
        }
        assets.forEach(UserUtils::checkOwnership);
        landAssetRepo.deleteAll(assets);
        return AssetUtils.getResponseEntity("Land assets deleted successfully", HttpStatus.OK);
    }


    private LandAssetDTO toDTO(LandAsset asset) {
        LandAssetDTO dto = new LandAssetDTO();
        dto.setId(asset.getId());
        dto.setUserId(asset.getUser().getId());
        dto.setLocation(asset.getLocation());
        dto.setArea(asset.getArea());
        dto.setPurchaseDate(asset.getPurchaseDate());
        dto.setSaleDate(asset.getSaleDate());
        dto.setAssetType(asset.getAssetType());
        dto.setCreatedAt(asset.getCreatedAt());
        return dto;
    }
}