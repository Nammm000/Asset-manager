package tech.getarrays.assetmanager.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import tech.getarrays.assetmanager.dto.CurrencyDTO;
import tech.getarrays.assetmanager.services.currency.CurrencyService;

import java.util.List;

@RestController
@RequestMapping("/currencies")
public class CurrencyController {

    CurrencyService currencyService;

    @Autowired
    public CurrencyController(CurrencyService theCurrencyService) {
        currencyService = theCurrencyService;
    }

    @GetMapping
    public ResponseEntity<List<CurrencyDTO>> getAllCurrencies() {
        return currencyService.getAllCurrencies();
    }

    @GetMapping("/{code}")
    public ResponseEntity<CurrencyDTO> getCurrencyByCode(@PathVariable String code) {
        return currencyService.getCurrencyByCode(code);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> createCurrency(@RequestBody CurrencyDTO currencyDTO) {
        return currencyService.createCurrency(currencyDTO);
    }

    @PutMapping("/{code}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> updateCurrency(@PathVariable String code, @RequestBody CurrencyDTO currencyDTO) {
        return currencyService.updateCurrency(code, currencyDTO);
    }

    @DeleteMapping("/{code}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> deleteCurrency(@PathVariable String code) {
        return currencyService.deleteCurrency(code);
    }
}