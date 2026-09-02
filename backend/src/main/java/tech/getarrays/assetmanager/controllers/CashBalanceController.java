package tech.getarrays.assetmanager.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.getarrays.assetmanager.dto.CashBalanceDTO;
import tech.getarrays.assetmanager.dto.PagedResponseDTO;
import tech.getarrays.assetmanager.services.asset.CashBalanceService;

@RestController
@RequestMapping("/cash-balances")
public class CashBalanceController {

    CashBalanceService cashBalanceService;

    @Autowired
    public CashBalanceController(CashBalanceService theCashBalanceService) {
        cashBalanceService = theCashBalanceService;
    }

    @GetMapping
    public ResponseEntity<PagedResponseDTO<CashBalanceDTO>> getMyCashBalances(
            @RequestParam(required = false) Long cashAssetId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return cashBalanceService.getMyCashBalances(cashAssetId, page, size);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CashBalanceDTO> getCashBalance(@PathVariable Long id) {
        return cashBalanceService.getCashBalance(id);
    }

    @PostMapping
    public ResponseEntity<CashBalanceDTO> createCashBalance(@RequestBody CashBalanceDTO balanceDTO) {
        return cashBalanceService.createCashBalance(balanceDTO);
    }

    @PostMapping("/{id}")
    public ResponseEntity<CashBalanceDTO> addOrSubtractCashBalance(@PathVariable Long id, @RequestBody CashBalanceDTO dto) {
        return cashBalanceService.addOrSubtractCashBalance(id, dto);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CashBalanceDTO> updateCashBalance(@PathVariable Long id, @RequestBody CashBalanceDTO balanceDTO) {
        return cashBalanceService.updateCashBalance(id, balanceDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteCashBalance(@PathVariable Long id) {
        return cashBalanceService.deleteCashBalance(id);
    }
}
