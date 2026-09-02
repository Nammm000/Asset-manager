package tech.getarrays.assetmanager.services.asset;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import tech.getarrays.assetmanager.constants.AssetConstants;
import tech.getarrays.assetmanager.dto.OtherAssetDTO;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.exception.NotFoundException;
import tech.getarrays.assetmanager.models.OtherAsset;
import tech.getarrays.assetmanager.models.User;
import tech.getarrays.assetmanager.repo.OtherAssetRepo;
import tech.getarrays.assetmanager.util.AssetUtils;
import tech.getarrays.assetmanager.util.UserUtils;

@Slf4j
@Service
public class OtherAssetService {

    OtherAssetRepo otherAssetRepo;

    @Autowired
    public OtherAssetService(OtherAssetRepo theOtherAssetRepo) {
        otherAssetRepo = theOtherAssetRepo;
    }

    public ResponseEntity<PagedResponseDTO<OtherAssetDTO>> getMyOtherAssets(int page, int size) {
        User user = UserUtils.getCurrentUser();
        Page<OtherAssetDTO> assets = otherAssetRepo
                .findByUserId(user.getId(), PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(this::toDTO);
        return new ResponseEntity<>(PagedResponseDTO.from(assets), HttpStatus.OK);
    }

    public ResponseEntity<OtherAssetDTO> getOtherAsset(Long id) {
        OtherAsset asset = otherAssetRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Other asset id " + id + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        return new ResponseEntity<>(toDTO(asset), HttpStatus.OK);
    }

    public ResponseEntity<OtherAssetDTO> createOtherAsset(OtherAssetDTO assetDTO) {
        if (assetDTO.getName() == null || assetDTO.getName().isBlank()
                || assetDTO.getAmount() == null
                || assetDTO.getPricePerUnit() == null) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        User user = UserUtils.getCurrentUser();
        OtherAsset asset = new OtherAsset();
        asset.setUser(user);
        asset.setName(assetDTO.getName());
        asset.setAmount(assetDTO.getAmount());
        asset.setPricePerUnit(assetDTO.getPricePerUnit());

        OtherAsset saved = otherAssetRepo.save(asset);
        return new ResponseEntity<>(toDTO(saved), HttpStatus.CREATED);
    }

    public ResponseEntity<OtherAssetDTO> updateOtherAsset(Long id, OtherAssetDTO assetDTO) {
        OtherAsset asset = otherAssetRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Other asset id " + id + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        if (assetDTO.getName() != null) {
            asset.setName(assetDTO.getName());
        }
        if (assetDTO.getAmount() != null) {
            asset.setAmount(assetDTO.getAmount());
        }
        if (assetDTO.getPricePerUnit() != null) {
            asset.setPricePerUnit(assetDTO.getPricePerUnit());
        }
        otherAssetRepo.save(asset);
        return new ResponseEntity<>(toDTO(asset), HttpStatus.OK);
    }

    public ResponseEntity<String> deleteOtherAsset(Long id) {
        OtherAsset asset = otherAssetRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Other asset id " + id + " doesn't exist"));
        UserUtils.checkOwnership(asset);
        otherAssetRepo.delete(asset);
        return AssetUtils.getResponseEntity("Other asset deleted successfully", HttpStatus.OK);
    }

    private OtherAssetDTO toDTO(OtherAsset asset) {
        OtherAssetDTO dto = new OtherAssetDTO();
        dto.setId(asset.getId());
        dto.setUserId(asset.getUser().getId());
        dto.setName(asset.getName());
        dto.setAmount(asset.getAmount());
        dto.setPricePerUnit(asset.getPricePerUnit());
        dto.setAssetType(asset.getAssetType());
        dto.setCreatedAt(asset.getCreatedAt());
        return dto;
    }
}