package tech.getarrays.assetmanager.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.getarrays.assetmanager.dto.LandAssetDTO;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.services.asset.LandAssetService;

@RestController
@RequestMapping("/land-assets")
public class LandAssetController {

    LandAssetService landAssetService;

    @Autowired
    public LandAssetController(LandAssetService theLandAssetService) {
        landAssetService = theLandAssetService;
    }

    @GetMapping
    public ResponseEntity<PagedResponseDTO<LandAssetDTO>> getMyLandAssets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return landAssetService.getMyLandAssets(page, size);
    }

    @GetMapping("/{id}")
    public ResponseEntity<LandAssetDTO> getLandAsset(@PathVariable Long id) {
        return landAssetService.getLandAsset(id);
    }

    @PostMapping
    public ResponseEntity<LandAssetDTO> createLandAsset(@RequestBody LandAssetDTO assetDTO) {
        return landAssetService.createLandAsset(assetDTO);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LandAssetDTO> updateLandAsset(@PathVariable Long id, @RequestBody LandAssetDTO assetDTO) {
        return landAssetService.updateLandAsset(id, assetDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteLandAsset(@PathVariable Long id) {
        return landAssetService.deleteLandAsset(id);
    }
}