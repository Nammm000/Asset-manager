package tech.getarrays.assetmanager.services.currency;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import tech.getarrays.assetmanager.constants.AssetConstants;
import tech.getarrays.assetmanager.dto.CurrencyDTO;
import tech.getarrays.assetmanager.exception.NotFoundException;
import tech.getarrays.assetmanager.models.Currency;
import tech.getarrays.assetmanager.repo.CurrencyRepo;
import tech.getarrays.assetmanager.util.AssetUtils;

import java.util.List;

@Slf4j
@Service
public class CurrencyService {

    CurrencyRepo currencyRepo;

    @Autowired
    public CurrencyService(CurrencyRepo theCurrencyRepo) {
        currencyRepo = theCurrencyRepo;
    }

    public ResponseEntity<List<CurrencyDTO>> getAllCurrencies() {
        try {
            List<CurrencyDTO> currencies = currencyRepo.findAll().stream()
                    .map(this::toDTO)
                    .toList();
            return new ResponseEntity<>(currencies, HttpStatus.OK);
        } catch (Exception ex) {
            log.error("Error getting all currencies", ex);
            return new ResponseEntity<>(new java.util.ArrayList<>(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public ResponseEntity<CurrencyDTO> getCurrencyByCode(String code) {
        Currency currency = currencyRepo.findById(code)
                .orElseThrow(() -> new NotFoundException("Currency '" + code + "' doesn't exist"));
        return new ResponseEntity<>(toDTO(currency), HttpStatus.OK);
    }

    public ResponseEntity<String> createCurrency(CurrencyDTO currencyDTO) {
        if (currencyDTO.getCode() == null || currencyDTO.getCode().isBlank()
                || currencyDTO.getCode().length() > 3
                || currencyDTO.getName() == null || currencyDTO.getName().isBlank()
                || currencyDTO.getDecimalPlaces() == null) {
            return AssetUtils.getResponseEntity(AssetConstants.INVALID_DATA, HttpStatus.BAD_REQUEST);
        }
        if (currencyRepo.existsById(currencyDTO.getCode())) {
            return AssetUtils.getResponseEntity("Currency '" + currencyDTO.getCode() + "' already exists", HttpStatus.CONFLICT);
        }
        Currency currency = new Currency();
        currency.setCode(currencyDTO.getCode());
        currency.setName(currencyDTO.getName());
        currency.setSymbol(currencyDTO.getSymbol());
        currency.setDecimalPlaces(currencyDTO.getDecimalPlaces());
        currencyRepo.save(currency);
        return AssetUtils.getResponseEntity("Currency created successfully", HttpStatus.CREATED);
    }

    public ResponseEntity<String> updateCurrency(String code, CurrencyDTO currencyDTO) {
        Currency currency = currencyRepo.findById(code)
                .orElseThrow(() -> new NotFoundException("Currency '" + code + "' doesn't exist"));
        if (currencyDTO.getName() != null) {
            currency.setName(currencyDTO.getName());
        }
        if (currencyDTO.getSymbol() != null) {
            currency.setSymbol(currencyDTO.getSymbol());
        }
        if (currencyDTO.getDecimalPlaces() != null) {
            currency.setDecimalPlaces(currencyDTO.getDecimalPlaces());
        }
        currencyRepo.save(currency);
        return AssetUtils.getResponseEntity("Currency updated successfully", HttpStatus.OK);
    }

    public ResponseEntity<String> deleteCurrency(String code) {
        Currency currency = currencyRepo.findById(code)
                .orElseThrow(() -> new NotFoundException("Currency '" + code + "' doesn't exist"));
        currencyRepo.delete(currency);
        return AssetUtils.getResponseEntity("Currency deleted successfully", HttpStatus.OK);
    }

    private CurrencyDTO toDTO(Currency currency) {
        CurrencyDTO dto = new CurrencyDTO();
        dto.setCode(currency.getCode());
        dto.setName(currency.getName());
        dto.setSymbol(currency.getSymbol());
        dto.setDecimalPlaces(currency.getDecimalPlaces());
        return dto;
    }
}