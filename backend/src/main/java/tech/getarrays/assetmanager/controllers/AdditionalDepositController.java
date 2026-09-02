package tech.getarrays.assetmanager.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.getarrays.assetmanager.dto.AdditionalDepositRequestDTO;
import tech.getarrays.assetmanager.dto.SavingsPassbookDTO;
import tech.getarrays.assetmanager.services.asset.AdditionalDepositService;

@RestController
@RequestMapping("/additional-deposits")
public class AdditionalDepositController {

    AdditionalDepositService additionalDepositService;

    @Autowired
    public AdditionalDepositController(AdditionalDepositService theAdditionalDepositService) {
        additionalDepositService = theAdditionalDepositService;
    }

    @PostMapping
    public ResponseEntity<SavingsPassbookDTO> deposit(@RequestBody AdditionalDepositRequestDTO requestDTO) {
        return additionalDepositService.deposit(requestDTO);
    }
}
