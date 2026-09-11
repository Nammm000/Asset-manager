package tech.getarrays.assetmanager.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.getarrays.assetmanager.dto.OtherAssetDTO;
import tech.getarrays.assetmanager.dto.BulkDeleteRequestDTO;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.services.asset.OtherAssetService;

@RestController
@RequestMapping("/other-assets")
public class OtherAssetController {

    OtherAssetService otherAssetService;

    @Autowired
    public OtherAssetController(OtherAssetService theOtherAssetService) {
        otherAssetService = theOtherAssetService;
    }

    @GetMapping
    public ResponseEntity<PagedResponseDTO<OtherAssetDTO>> getMyOtherAssets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return otherAssetService.getMyOtherAssets(page, size);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OtherAssetDTO> getOtherAsset(@PathVariable Long id) {
        return otherAssetService.getOtherAsset(id);
    }

    @PostMapping
    public ResponseEntity<OtherAssetDTO> createOtherAsset(@RequestBody OtherAssetDTO assetDTO) {
        return otherAssetService.createOtherAsset(assetDTO);
    }

    @PutMapping("/{id}")
    public ResponseEntity<OtherAssetDTO> updateOtherAsset(@PathVariable Long id, @RequestBody OtherAssetDTO assetDTO) {
        return otherAssetService.updateOtherAsset(id, assetDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteOtherAsset(@PathVariable Long id) {
        return otherAssetService.deleteOtherAsset(id);
    }

    @DeleteMapping("/bulk")
    public ResponseEntity<String> deleteOtherAssets(@RequestBody BulkDeleteRequestDTO request) {
        return otherAssetService.deleteOtherAssets(request);
    }
}