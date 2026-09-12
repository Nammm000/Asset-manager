package tech.getarrays.assetmanager.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.getarrays.assetmanager.dto.BulkDeleteRequestDTO;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.dto.SavingsPassbookDTO;
import tech.getarrays.assetmanager.dto.SavingsPassbookSearchRequestDTO;
import tech.getarrays.assetmanager.services.asset.SavingsPassbookService;

@RestController
@RequestMapping("/savings-passbooks")
public class SavingsPassbookController {

    SavingsPassbookService savingsPassbookService;

    @Autowired
    public SavingsPassbookController(SavingsPassbookService theSavingsPassbookService) {
        savingsPassbookService = theSavingsPassbookService;
    }

    @GetMapping
    public ResponseEntity<PagedResponseDTO<SavingsPassbookDTO>> getMySavingsPassbooks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return savingsPassbookService.getMySavingsPassbooks(page, size);
    }

    @GetMapping("/search")
    public ResponseEntity<PagedResponseDTO<SavingsPassbookDTO>> searchMySavingsPassbooks(
            @ModelAttribute SavingsPassbookSearchRequestDTO request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return savingsPassbookService.searchMySavingsPassbooks(request, page, size);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SavingsPassbookDTO> getSavingsPassbook(@PathVariable Long id) {
        return savingsPassbookService.getSavingsPassbook(id);
    }

    @PostMapping
    public ResponseEntity<SavingsPassbookDTO> createSavingsPassbook(@RequestBody SavingsPassbookDTO passbookDTO) {
        return savingsPassbookService.createSavingsPassbook(passbookDTO);
    }

    @PutMapping("/{id}")
    public ResponseEntity<SavingsPassbookDTO> updateSavingsPassbook(@PathVariable Long id, @RequestBody SavingsPassbookDTO passbookDTO) {
        return savingsPassbookService.updateSavingsPassbook(id, passbookDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteSavingsPassbook(@PathVariable Long id) {
        return savingsPassbookService.deleteSavingsPassbook(id);
    }

    @DeleteMapping("/bulk")
    public ResponseEntity<String> deleteSavingsPassbooks(@RequestBody BulkDeleteRequestDTO request) {
        return savingsPassbookService.deleteSavingsPassbooks(request);
    }
}
