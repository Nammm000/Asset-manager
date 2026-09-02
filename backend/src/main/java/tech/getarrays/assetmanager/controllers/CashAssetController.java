package tech.getarrays.assetmanager.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.getarrays.assetmanager.dto.CashAssetDTO;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.services.asset.CashAssetService;

@RestController
@RequestMapping("/cash-assets")
public class CashAssetController {

    CashAssetService cashAssetService;

    @Autowired
    public CashAssetController(CashAssetService theCashAssetService) {
        cashAssetService = theCashAssetService;
    }

    @GetMapping
    public ResponseEntity<PagedResponseDTO<CashAssetDTO>> getMyCashAssets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return cashAssetService.getMyCashAssets(page, size);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CashAssetDTO> getCashAsset(@PathVariable Long id) {
        return cashAssetService.getCashAsset(id);
    }

    @PostMapping
    public ResponseEntity<CashAssetDTO> createCashAsset(@RequestBody CashAssetDTO dto) {
        return cashAssetService.createCashAsset(dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteCashAsset(@PathVariable Long id) {
        return cashAssetService.deleteCashAsset(id);
    }
}
